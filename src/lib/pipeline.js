// The analysis runs on the api (Phase 6): POST /api/engagements/:id/analysis-jobs, followed live on the
// event stream (reviewStore.startAnalysis and App.jsx). The api uses the same engine, ported from the
// browser pipeline that used to be here, and its parity test checks it gives the same results.
// What stays here is what the screens need to re-run the checks instantly when settings change.

// Figures that the engagement can override or add before the checks run.
export const withSetup = (K, setup) => ({
  ...K, feeMonths: setup.feeMonths,
  mgmtRate: setup.feeRatePct != null && setup.feeRatePct !== '' ? setup.feeRatePct / 100 : K.mgmtRate
});
export const varianceOpts = setup => ({ mode: setup.varianceMode, investigatePct: setup.investigatePct, explainPct: setup.explainPct });
