// The product's name and maker, in one place: the sign-in page, the sidebar, the window title,
// exports and reports all read it from here.
export const BRAND = {
  name: 'StatementX',
  /** the first part of the name; the wordmark (components/BrandWordmark.jsx) draws the X after it */
  word: 'Statement',
  by: 'By Project Accountants',
  firm: 'Project Accountants',
  tagline: 'AI-assisted review of financial statements.',
  /** who "Contact support" on the sign-in page emails (it opens the person's email app); hidden while empty */
  supportEmail: 'muhammad.salman@projectaccountants.co.uk',
  /** the Prepare FS application, opened in a new tab from the top bar; the button is hidden while this is empty */
  prepareFsUrl: '/prepare-fs.html'
};
