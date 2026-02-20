% ============================================================
% MFS Loan Assessment Expert System
% Motsitseng Financial Services — SWI-Prolog
% Usage: swipl loan_system.pl   then run via CLI prompt
% ============================================================

:- dynamic applicant/9.

% applicant(Name, Age, EmployStatus, MonthlyIncome, MonthlyExpenses,
%           CreditScore, ExistingDebts, LoanAmount, RepayMonths)

% ── Helper Predicates ───────────────────────────────────────

disposable_income(Name, Disposable) :-
    applicant(Name, _, _, Income, Expenses, _, Debts, _, _),
    Disposable is Income - Expenses - Debts.

monthly_repayment(Name, Rep) :-
    applicant(Name, _, _, _, _, _, _, LoanAmt, Months),
    Months > 0, LoanAmt > 0,
    Rate is 0.10 / 12,
    Rep is (LoanAmt * Rate * (1 + Rate)^Months) /
           ((1 + Rate)^Months - 1).

debt_to_income(Name, Ratio) :-
    applicant(Name, _, _, Income, _, _, Debts, _, _),
    Income > 0,
    Ratio is (Debts / Income) * 100.

% ── Eligibility Rules ───────────────────────────────────────

age_eligible(Name) :-
    applicant(Name, Age, _, _, _, _, _, _, _),
    Age >= 18, Age =< 65.

employment_eligible(Name) :-
    applicant(Name, _, Status, _, _, _, _, _, _),
    member(Status, [employed, self_employed]).

credit_eligible(Name) :-
    applicant(Name, _, _, _, _, Score, _, _, _),
    Score >= 600.

affordable(Name) :-
    applicant(Name, _, _, Income, _, _, _, _, _),
    monthly_repayment(Name, Rep),
    Rep =< Income * 0.40.

low_debt_ratio(Name) :-
    debt_to_income(Name, Ratio),
    Ratio =< 40.

has_disposable_income(Name) :-
    disposable_income(Name, D), D > 0.

% ── Decision Rules ──────────────────────────────────────────

loan_decision(Name, approved) :-
    age_eligible(Name),
    employment_eligible(Name),
    credit_eligible(Name),
    affordable(Name),
    low_debt_ratio(Name),
    has_disposable_income(Name).

loan_decision(Name, conditional_approved) :-
    age_eligible(Name),
    employment_eligible(Name),
    has_disposable_income(Name),
    affordable(Name),
    ( \+ credit_eligible(Name) ; \+ low_debt_ratio(Name) ).

loan_decision(Name, rejected) :-
    ( \+ age_eligible(Name)
    ; \+ employment_eligible(Name)
    ; \+ has_disposable_income(Name)
    ; \+ affordable(Name)
    ).

% ── Reason Collector ────────────────────────────────────────

rejection_reasons(Name, Reasons) :-
    findall(R, reason(Name, R), Reasons).

reason(Name, 'Age outside eligible range (18-65)') :-
    \+ age_eligible(Name).
reason(Name, 'Must be employed or self-employed') :-
    \+ employment_eligible(Name).
reason(Name, 'No positive disposable income after expenses and debts') :-
    \+ has_disposable_income(Name).
reason(Name, 'Monthly repayment exceeds 40% of income') :-
    \+ affordable(Name).
reason(Name, 'Credit score below minimum threshold of 600') :-
    \+ credit_eligible(Name).
reason(Name, 'Debt-to-income ratio exceeds 40%') :-
    \+ low_debt_ratio(Name).

% ── CLI ─────────────────────────────────────────────────────

print_summary(Name) :-
    loan_decision(Name, Decision),
    rejection_reasons(Name, Reasons),
    monthly_repayment(Name, Rep),
    disposable_income(Name, Disp),
    debt_to_income(Name, DTI),
    nl,
    write('=== MFS LOAN DECISION ==='), nl,
    format('Decision    : ~w~n', [Decision]),
    format('Monthly Rep : LSL ~2f~n', [Rep]),
    format('Disposable  : LSL ~2f~n', [Disp]),
    format('DTI Ratio   : ~2f%~n', [DTI]),
    ( Reasons \= []
    -> ( write('Reasons:'), nl,
         maplist([R]>>(write('  - '), write(R), nl), Reasons) )
    ;  write('All criteria satisfied.'), nl
    ).

run :-
    nl, write('=== MFS Loan Assessment Expert System ==='), nl,
    write('Applicant name: '), read(Name),
    write('Age: '), read(Age),
    write('Employment (employed/self_employed/unemployed/retired): '), read(Emp),
    write('Monthly income (LSL): '), read(Income),
    write('Monthly expenses (LSL): '), read(Expenses),
    write('Credit score (300-850): '), read(Score),
    write('Existing monthly debts (LSL): '), read(Debts),
    write('Loan amount (LSL): '), read(LoanAmt),
    write('Repayment months: '), read(Months),
    assertz(applicant(Name,Age,Emp,Income,Expenses,Score,Debts,LoanAmt,Months)),
    print_summary(Name),
    retract(applicant(Name,_,_,_,_,_,_,_,_)),
    nl, write('Run again? (yes/no): '), read(Again),
    ( Again = yes -> run ; write('Goodbye.'), nl ).
