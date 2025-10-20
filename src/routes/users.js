const express = require('express');
const users = require('../../data/users');

const router = express.Router();

function parsePositiveInteger(value, defaultValue) {
  if (value === undefined) {
    return defaultValue;
  }

  const parsed = Number.parseInt(value, 10);

  if (Number.isNaN(parsed) || parsed < 1) {
    return null;
  }

  return parsed;
}

router.get('/', (req, res) => {
  const limit = parsePositiveInteger(req.query.limit, 10);
  const page = parsePositiveInteger(req.query.page, 1);

  if (limit === null || page === null) {
    return res.status(400).json({
      error: 'Invalid pagination parameters. "page" and "limit" must be positive integers.',
    });
  }

  const totalUsers = users.length;
  const totalPages = totalUsers === 0 ? 0 : Math.ceil(totalUsers / limit);
  const startIndex = (page - 1) * limit;
  const paginatedUsers = startIndex >= totalUsers ? [] : users.slice(startIndex, startIndex + limit);

  return res.json({
    data: paginatedUsers,
    pagination: {
      page,
      limit,
      totalPages,
      totalUsers,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1 && totalUsers > 0,
    },
  });
});

module.exports = router;
