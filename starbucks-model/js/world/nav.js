// No walking navigation in this game: the committee sits, and the people in the model walk on scripted routes
// (walkTo with nav:false). character.js still imports these two.
export function segmentBlocked() { return false; }
export function findPath() { return null; }
