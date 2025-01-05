const express = require("express");
const redis = require("redis");
const axios = require("axios");

const redisUrl = "redis://localhost:6379";
const companyId = 4;
let redisClient;

(async () => {
  redisClient = redis.createClient(redisUrl);

  redisClient.on("error", (error) => console.error(`Error : ${error}`));

  await redisClient.connect();
})();

const app = express();
const port = process.env.PORT || 3001;

app.use(express.json());

app.post("/", async (req, res) => {
  const { key, value } = req.body;
  const response = await redisClient.set(key, value, {
    EX: 180,
    NX: true,
  });
  res.json(response);
});

app.get("/", async (req, res) => {
  const { key } = req.body;
  const response = await redisClient.get(key);
  res.json(response);
});

app.get("/posts/:id", async (req, res) => {
  const { id } = req.params;
  const cachedPost = await redisClient.get(`${companyId}:post:${id}`);

  if (cachedPost) {
    return res.json(JSON.parse(cachedPost));
  }

  const response = await axios.get(
    `https://jsonplaceholder.typicode.com/posts/${id}`
  );

  await redisClient.set(
    `${companyId}:post:${id}`,
    JSON.stringify(response.data)
  );

  res.json(response.data);
});

app.delete("/posts", async (req, res) => {
  try {
    const response = await deleteKeysByPattern(`${companyId}:post:*`);
    console.log(response);
    res.json("delete success");
    redisClient.quit();
  } catch (error) {
    console.error("Error:", err);
    redisClient.quit();
  }
});

const deleteKeysByPattern = async (pattern) => {
  let cursor = "0";
  do {
    try {
      const reply = await redisClient.scan(
        cursor,
        "MATCH",
        pattern,
        "COUNT",
        100
      );

      cursor = reply.cursor; // Next cursor
      const keys = reply.keys;

      if (keys.length > 0) {
        await redisClient.del(...keys);
        console.log(`Deleted keys: ${keys}`);
      } else {
        return Promise.resolve(true);
      }
    } catch (error) {
      return Promise.reject(error);
    }
  } while (cursor !== "0");
};

app.listen(port, () => {
  console.log(`App listening on port ${port}`);
});
