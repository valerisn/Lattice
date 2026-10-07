import { database } from "../src/server/db";
database()
  .then(() => {
    console.log("Database migrations applied.");
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
