/**
 * Unlimited Undo & Redo Management Module
 * Gully Cricket Scorer
 * Designed & Developed by Ashif Web Studio
 * Developer: Mohammad Ashif (mohdashif.dev@gmail.com)
 */

export const UndoManager = {
  /**
   * Take a deep snapshot of match state before a mutating action
   */
  captureSnapshot(match) {
    if (!match) return;
    if (!match.historyStack) match.historyStack = [];
    if (!match.redoStack) match.redoStack = [];

    // Clone match state without recursive stacks to keep memory light
    const { historyStack, redoStack, ...stateToSave } = match;
    const cloned = JSON.parse(JSON.stringify(stateToSave));

    match.historyStack.push(cloned);
    // Clear redo stack on every new action
    match.redoStack = [];
  },

  /**
   * Revert match to previous state (Unlimited Undo)
   */
  undo(match) {
    if (!match || !match.historyStack || match.historyStack.length === 0) {
      return { success: false, message: 'Nothing to undo' };
    }

    const { historyStack, redoStack, ...currentState } = match;
    const previousSnapshot = match.historyStack.pop();

    match.redoStack.push(JSON.parse(JSON.stringify(currentState)));

    // Restore all properties
    Object.keys(previousSnapshot).forEach(key => {
      match[key] = previousSnapshot[key];
    });

    console.log('[UndoManager] Successfully restored previous state. Remaining history:', match.historyStack.length);
    return { success: true, match };
  },

  /**
   * Redo an undone action
   */
  redo(match) {
    if (!match || !match.redoStack || match.redoStack.length === 0) {
      return { success: false, message: 'Nothing to redo' };
    }

    const { historyStack, redoStack, ...currentState } = match;
    const nextSnapshot = match.redoStack.pop();

    match.historyStack.push(JSON.parse(JSON.stringify(currentState)));

    Object.keys(nextSnapshot).forEach(key => {
      match[key] = nextSnapshot[key];
    });

    console.log('[UndoManager] Successfully redid action.');
    return { success: true, match };
  }
};
