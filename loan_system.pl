% ============================================================
% MFS Loan Assessment Expert System
% Motsitseng Financial Services
% SWI-Prolog Implementation
% Course: Artificial Intelligence BIAI4212/BIAI3210
% ============================================================

% --- Dynamic fact declaration (user input loaded at runtime) ---
:- dynamic applicant/9.

% applicant(Name, Age, EmploymentStatus, MonthlyIncome,
%           MonthlyExpenses, CreditScore, ExistingDebts,
%           LoanAmount, RepaymentMonths)


% ============================================================
% SECTION 1: HELPER CALCULATIONS
% ============================================================

% disposable_income(+Name, -Disposable)
% Calculates net income after expenses and existing debts
disposable_income(Name, Disposable) :-
    applicant(Name, _, _, Income, Expenses, _, Debts, _, _),
    Disposable is Income - Expenses - Debts.

% monthly_repayment(+Name, -Rep)
% Amortization formula at 10% annual interest rate
monthly_repayment(Name, Rep) :-
    applicant(Name, _, _, _, _, _, _, LoanAmt, Months),
    Months > 0,
    Rate is 0.10 / 12,
    Factor is (1 + Rate) ** Months,
    Rep is (LoanAmt * Rate * Factor) / (Factor - 1).

% debt_to_income(+Name, -Ratio)
% Percentage of income consumed by existing debts
debt_to_income(Name, Ratio) :-
    applicant(Name, _, _, Income, _, _, Debts, _, _),
    Income > 0,
    Ratio is (Debts / Income) * 100.


% ============================================================
% SECTION 2: ELIGIBILITY RULE PREDICATES
% ============================================================

% age_eligible(+Name)
% Applicant must be between 18 and 65 years old
age_eligible(Name) :-
    applicant(Name, Age, _, _, _, _, _, _, _),
    Age >= 18,
    Age =< 65.

% employment_eligible(+Name)
% Must be employed or self-employed (not unemployed or retired)
employment_eligible(Name) :-
    applicant(Name, _, Status, _, _, _, _, _, _),
    member(Status, [employed, self_employed]).

% credit_eligible(+Name)
% Credit score must be at least 600 for full approval
credit_eligible(Name) :-
    applicant(Name, _, _, _, _, Score, _, _, _),
    Score >= 600.

% affordable(+Name)
% Monthly repayment must not exceed 40% of monthly income
affordable(Name) :-
    applicant(Name, _, _, Income, _, _, _, _, _),
    monthly_repayment(Name, Rep),
    Rep =< Income * 0.40.

% low_debt_ratio(+Name)
% Existing debt-to-income ratio must be 40% or below
low_debt_ratio(Name) :-
    debt_to_income(Name, Ratio),
    Ratio =< 40.

% has_disposable_income(+Name)
% Must have positive disposable income after expenses and debts
has_disposable_income(Name) :-
    disposable_income(Name, D),
    D > 0.


% ============================================================
% SECTION 3: MAIN DECISION RULES
% ============================================================

% loan_decision(+Name, -Decision)
% Returns: approved | conditional_approved | rejected

% APPROVED: All six criteria fully satisfied
loan_decision(Name, approved) :-
    age_eligible(Name),
    employment_eligible(Name),
    credit_eligible(Name),
    affordable(Name),
    low_debt_ratio(Name),
    has_disposable_income(Name).

% CONDITIONAL APPROVED: Core criteria met but credit score
% or debt-to-income ratio is borderline
loan_decision(Name, conditional_approved) :-
    age_eligible(Name),
    employment_eligible(Name),
    has_disposable_income(Name),
    affordable(Name),
    ( \+ credit_eligible(Name) ; \+ low_debt_ratio(Name) ).

% REJECTED: Any major disqualifying condition present
loan_decision(Name, rejected) :-
    ( \+ age_eligible(Name)
    ; \+ employment_eligible(Name)
    ; \+ has_disposable_income(Name)
    ; \+ affordable(Name)
    ).


% ============================================================
% SECTION 4: REASON COLLECTOR
% ============================================================

% rejection_reasons(+Name, -Reasons)
% Collects all reasons for non-approval as a list
rejection_reasons(Name, Reasons) :-
    findall(R, reason(Name, R), Reasons).

reason(Name, 'Age out of eligible range (must be 18 to 65 years old)') :-
    \+ age_eligible(Name).

reason(Name, 'Applicant must be employed or self-employed') :-
    \+ employment_eligible(Name).

reason(Name, 'No positive disposable income after expenses and existing debts') :-
    \+ has_disposable_income(Name).

reason(Name, 'Monthly loan repayment exceeds 40% of monthly income (affordability rule)') :-
    \+ affordable(Name).

reason(Name, 'Credit score is below the minimum threshold of 600') :-
    \+ credit_eligible(Name).

reason(Name, 'Debt-to-income ratio exceeds the 40% maximum') :-
    \+ low_debt_ratio(Name).


% ============================================================
% SECTION 5: DISPLAY HELPERS
% ============================================================

print_line :-
    write('--------------------------------------------------'), nl.

print_header :-
    nl,
    write('=================================================='), nl,
    write('  MFS LOAN ASSESSMENT EXPERT SYSTEM               '), nl,
    write('  Motsitseng Financial Services                   '), nl,
    write('=================================================='), nl, nl.

print_decision(Name) :-
    loan_decision(Name, Decision),
    monthly_repayment(Name, Rep),
    disposable_income(Name, Disp),
    debt_to_income(Name, DTI),
    rejection_reasons(Name, Reasons),
    nl,
    print_line,
    format('  DECISION  : ~w~n', [Decision]),
    format('  Est. Monthly Repayment : LSL ~2f~n', [Rep]),
    format('  Disposable Income      : LSL ~2f~n', [Disp]),
    format('  Debt-to-Income Ratio   : ~2f%~n', [DTI]),
    print_line,
    ( Reasons \= [] ->
        ( write('  REASONS / CONDITIONS:'), nl,
          maplist([R] >> (write('    * '), write(R), nl), Reasons) )
    ; write('  All criteria satisfied.'), nl
    ),
    print_line, nl.


% ============================================================
% SECTION 6: INTERACTIVE CLI INTERFACE
% ============================================================

% run/0 — Entry point for interactive use
% Launch with: ?- run.
run :-
    print_header,
    write('Enter applicant name (atom, e.g. john_doe): '), read(Name),
    write('Enter age (integer): '), read(Age),
    write('Employment status (employed/self_employed/unemployed/retired): '), read(Emp),
    write('Monthly income in LSL: '), read(Income),
    write('Monthly expenses in LSL (rent, food, transport): '), read(Expenses),
    write('Credit score (300-850): '), read(Score),
    write('Existing monthly debt payments in LSL: '), read(Debts),
    write('Loan amount requested in LSL: '), read(LoanAmt),
    write('Repayment period in months: '), read(Months),
    nl,
    assertz(applicant(Name, Age, Emp, Income, Expenses, Score, Debts, LoanAmt, Months)),
    print_decision(Name),
    retract(applicant(Name, _, _, _, _, _, _, _, _)),
    write('Assess another applicant? (yes/no): '), read(Again),
    ( Again == yes -> run ; write('Thank you for using MFS Expert System.'), nl ).

% run_batch/0 — Evaluate multiple pre-loaded applicants
run_batch :-
    print_header,
    forall(
        applicant(Name, _, _, _, _, _, _, _, _),
        ( format('Evaluating: ~w~n', [Name]), print_decision(Name) )
    ).

% ============================================================
% SECTION 7: TEST CASES (comment out for production)
% ============================================================
% Uncomment these to test without interactive input:
%
% :- assertz(applicant(alice, 32, employed, 18000, 6000, 720, 1500, 60000, 36)).
% :- assertz(applicant(bob,   25, unemployed, 4000, 3500, 540, 0, 15000, 12)).
% :- assertz(applicant(carol, 45, self_employed, 22000, 9000, 610, 7000, 80000, 24)).
%
% Test queries:
% ?- loan_decision(alice, D).    % Expected: approved
% ?- loan_decision(bob, D).      % Expected: rejected
% ?- loan_decision(carol, D).    % Expected: conditional_approved
