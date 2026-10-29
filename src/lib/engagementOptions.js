// Optional review settings decided per client (entity) at onboarding, with a fund-level override.
//   Partner sign-off: off by default, so the Manager's sign-off is final.
//   Umbrella accounts: off by default, so each fund's accounts are separate documents.
// A fund setting of '' follows its client; 'on' / 'off' overrides it.
const pick = (fundSetting, clientSetting) => (fundSetting === 'on' ? true : fundSetting === 'off' ? false : !!clientSetting);
export const partnerRequired = (eng, ent) => pick(eng?.partnerSignoff, ent?.partnerSignoff);
export const umbrellaFor = (eng, ent) => pick(eng?.umbrella, ent?.umbrella);
export const LOCKED_STATES = ['signed', 'manager-signed'];   // read-only once the Manager signs
