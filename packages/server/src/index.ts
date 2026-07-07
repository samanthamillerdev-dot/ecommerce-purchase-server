import { createApp } from "./app";
import { config } from "./config";
import { openDb } from "./db";

const db = openDb();
const app = createApp(db);

app.listen(config.port, () => {
  console.log(`server listening on :${config.port}`);
});
