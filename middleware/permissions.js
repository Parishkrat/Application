function getUserRole(todo, username) {
  if (todo.owner === username) return "owner";
  const sharedUser = todo.sharedWith.find((u) => u.name === username);
  return sharedUser ? sharedUser.role : null;
}
module.exports = { getUserRole };
