const users = Array.from({ length: 50 }, (_, index) => {
  const id = index + 1;
  return {
    id,
    username: `user${id}`,
    email: `user${id}@example.com`,
    name: `User ${id}`,
  };
});

module.exports = users;
