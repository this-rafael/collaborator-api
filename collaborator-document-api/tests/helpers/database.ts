import type {Db} from "mongodb";

export const resetDatabase = async (database: Db): Promise<void> => {
  const collections = await database.listCollections().toArray();
  await Promise.all(collections.map(({name}) => database.collection(name).deleteMany({})));
};
