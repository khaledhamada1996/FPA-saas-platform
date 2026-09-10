# AI Architecture

## Role of AI

AI is the platform's financial analyst and decision-support interface. It is not the source of truth for financial calculations.

## Capabilities

- Explain revenue, margin, EBITDA, cash, and KPI movements.
- Answer questions about actuals, budgets, forecasts, and scenarios.
- Summarize management reports.
- Identify unusual or material changes.
- Suggest areas for investigation.
- Assist with scenario interpretation.
- Draft management commentary.
- Propose actions for human review.

## Grounding Architecture

User question → permission check → intent classification → retrieve authorized model data → invoke deterministic calculations/query tools → construct context → model response → validation/formatting.

## Financial Tool Layer

AI should access explicit tools such as:

- get_metric
- compare_periods
- compare_actual_budget
- compare_actual_forecast
- get_variance_drivers
- get_cash_forecast
- get_kpi
- run_scenario
- list_alerts
- summarize_report

Tool outputs should be structured and typed.

## Guardrails

- Never fabricate financial figures.
- Clearly distinguish actual, budget, forecast, and scenario values.
- State when data is missing or insufficient.
- Respect user and organization authorization.
- Do not silently modify financial data.
- Require explicit confirmation for any future write-capable AI action.
- Preserve auditability of AI-assisted actions.

## Explainability

Where practical, responses should identify the period, metric, comparison basis, and principal drivers used to reach the conclusion.

## Provider Abstraction

AI provider/model selection must be abstracted behind an internal interface to allow model upgrades, fallback models, cost controls, and enterprise deployment choices without changing core FP&A logic.
