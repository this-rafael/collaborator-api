import type {Db} from "mongodb";

export const resetDatabase = async (database: Db): Promise<void> => {
  await database.dropDatabase();
};
