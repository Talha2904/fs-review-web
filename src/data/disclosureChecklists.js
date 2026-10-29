// STARTER disclosure checklists for investment funds. They are deliberately short and generic, with
// indicative references: replace them with the firm's own checklist (Administration › Disclosure
// Checklists › Import from Excel). keywords are used to suggest where an item may be disclosed.
const it = (ref, section, text, keywords) => ({ id: `${ref}`.replace(/[^A-Za-z0-9.]/g, '') + '-' + text.slice(0, 12).replace(/\W/g, ''), ref, section, text, keywords });

export const FRAMEWORKS = ['FRS 102', 'IFRS'];
export const STARTER = {
  'FRS 102': { version: 'starter', starter: true, items: [
    it('3.3', 'Basis of preparation', 'Statement of compliance with FRS 102', ['FRS 102', 'compliance with']),
    it('3.9', 'Basis of preparation', 'Going concern assessment and any material uncertainties', ['going concern']),
    it('30.25', 'Basis of preparation', 'Functional and presentation currency', ['functional currency', 'presentation currency', 'presented in']),
    it('8.4', 'Accounting policies', 'Accounting policy for financial assets at fair value through profit or loss', ['accounting polic', 'fair value through profit or loss']),
    it('8.4b', 'Accounting policies', 'Income recognition policies (dividends, interest)', ['ex-dividend', 'effective interest', 'recognised']),
    it('11.43', 'Financial instruments', 'Fair value hierarchy analysis by level', ['fair value hierarchy', 'level 1', 'level 2']),
    it('11.43b', 'Financial instruments', 'Valuation techniques and inputs for Level 3 investments, or a statement that there are none', ['level 3', 'valuation technique']),
    it('34.24', 'Financial risks', 'Market (price) risk and sensitivity', ['market risk', 'price risk', 'sensitivity']),
    it('34.27', 'Financial risks', 'Credit risk, including counterparty and depositary exposure', ['credit risk', 'counterparty']),
    it('34.28', 'Financial risks', 'Liquidity risk and redemption terms', ['liquidity risk', 'redemption']),
    it('34.29', 'Financial risks', 'Interest rate and currency risk', ['interest rate risk', 'currency risk', 'foreign currency']),
    it('33.9', 'Related parties', 'Related party transactions, including investment manager fees and directors’ fees', ['related part', 'management fee', 'directors']),
    it('22.17', 'Shares', 'Redeemable participating shares: movement in shares in issue', ['shares in issue', 'redeemable participating shares']),
    it('22.17b', 'Shares', 'Distributions paid and payable, if any', ['distribution']),
    it('29.26', 'Taxation', 'Tax status of the fund and withholding tax', ['tax', 'withholding']),
    it('32.10', 'Events after the reporting date', 'Events after the end of the reporting period', ['events after', 'subsequent event', 'after the reporting date']),
    it('32.9', 'Approval', 'Date the financial statements were authorised for issue and by whom', ['approved by the board', 'authorised for issue']),
    it('3.14', 'Comparatives', 'Comparative information for the prior period', ['prior year', 'comparative'])
  ] },
  'IFRS': { version: 'starter', starter: true, items: [
    it('IAS 1.16', 'Basis of preparation', 'Statement of compliance with IFRS', ['IFRS', 'compliance with']),
    it('IAS 1.25', 'Basis of preparation', 'Going concern assessment and any material uncertainties', ['going concern']),
    it('IAS 21.53', 'Basis of preparation', 'Functional and presentation currency', ['functional currency', 'presentation currency', 'presented in']),
    it('IFRS 9 / IAS 1.117', 'Accounting policies', 'Classification and measurement of financial assets at fair value through profit or loss', ['fair value through profit or loss', 'classif']),
    it('IAS 32.16A', 'Shares', 'Classification of redeemable (puttable) shares as liabilities or equity', ['puttable', 'redeemable participating shares']),
    it('IFRS 13.93', 'Fair value', 'Fair value hierarchy analysis by level', ['fair value hierarchy', 'level 1', 'level 2']),
    it('IFRS 13.93d', 'Fair value', 'Valuation techniques and inputs for Level 3, or a statement that there are none', ['level 3', 'valuation technique']),
    it('IFRS 13.93e', 'Fair value', 'Transfers between levels of the hierarchy', ['transfers between levels']),
    it('IFRS 7.33', 'Financial risks', 'Nature and extent of risks arising from financial instruments', ['risk management', 'financial risk']),
    it('IFRS 7.40', 'Financial risks', 'Market risk sensitivity analysis', ['market risk', 'sensitivity']),
    it('IFRS 7.35', 'Financial risks', 'Credit risk exposure', ['credit risk']),
    it('IFRS 7.39', 'Financial risks', 'Liquidity risk and maturity analysis', ['liquidity risk', 'maturity']),
    it('IAS 24.18', 'Related parties', 'Related party transactions, including investment manager fees and directors’ fees', ['related part', 'management fee', 'directors']),
    it('IFRS 10.19A', 'Investment entity', 'Investment entity status and judgements, if applicable', ['investment entity']),
    it('IAS 10.21', 'Events after the reporting date', 'Events after the reporting period', ['events after', 'subsequent event', 'after the reporting date']),
    it('IAS 10.17', 'Approval', 'Date of authorisation for issue and who authorised it', ['authorised for issue', 'approved by the board']),
    it('IAS 1.38', 'Comparatives', 'Comparative information for the preceding period', ['prior year', 'comparative'])
  ] }
};
