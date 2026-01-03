require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { weatherAgent } = require('./weatherAgent');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Weather agent endpoint
app.post('/api/weather', async (req, res) => {
  try {
    const { query } = req.body;
    const result = await weatherAgent(query);
    res.json(result);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
