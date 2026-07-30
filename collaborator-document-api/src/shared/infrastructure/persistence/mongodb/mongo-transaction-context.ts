import type {ClientSession} from "mongoose";

import type {TransactionContext} from "../../../domain/transaction-context.js";

const sessions = new WeakMap<object, ClientSession>();

/** Cria o contexto opaco associado a uma sessão MongoDB. */
export const createMongoTransactionContext = (session: ClientSession): TransactionContext => {
  const context = Object.freeze({}) as TransactionContext;
  sessions.set(context, session);
  return context;
};

/**
 * Recupera a sessão para um adaptador MongoDB. Retorna `undefined` para
 * contextos que não pertencem a este adaptador, sem lançar exceção técnica.
 */
export const getMongoSession = (context: TransactionContext): ClientSession | undefined =>
  sessions.get(context);
