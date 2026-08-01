import type {ClientSession} from "mongoose";

import type {TransactionContext} from "../../../domain/transaction-context.js";

const sessions = new WeakMap<object, ClientSession>();

/**
 * Cria o contexto opaco associado a uma sessão MongoDB.
 *
 * @param session - Sessão Mongoose que executa a transação.
 * @returns Contexto opaco (branded) vinculado à sessão via `WeakMap`.
 */
export const createMongoTransactionContext = (session: ClientSession): TransactionContext => {
  const context = Object.freeze({}) as TransactionContext;
  sessions.set(context, session);
  return context;
};

/**
 * Recupera a sessão MongoDB associada a um contexto de transação.
 *
 * @param context - Contexto de transação opaco recebido pela porta.
 * @returns A `ClientSession` correspondente ou `undefined` quando o contexto
 *   não pertence a este adaptador (sem lançar exceção técnica).
 */
export const getMongoSession = (context: TransactionContext): ClientSession | undefined =>
  sessions.get(context);
