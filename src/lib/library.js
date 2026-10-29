// The firm's check library (built-in rules plus the Administrator's edits and new rules),
// provided to every screen through React context.
import { createContext, useContext } from 'react';
import { LIBRARY } from '../data/checkLibrary';

export const LibraryContext = createContext(LIBRARY);
export const useLibrary = () => useContext(LibraryContext);
