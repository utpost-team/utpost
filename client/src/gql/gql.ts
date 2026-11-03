/* eslint-disable */
import * as types from './graphql';
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';

/**
 * Map of all GraphQL operations in the project.
 *
 * This map has several performance disadvantages:
 * 1. It is not tree-shakeable, so it will include all operations in the project.
 * 2. It is not minifiable, so the string of a GraphQL query will be multiple times inside the bundle.
 * 3. It does not support dead code elimination, so it will add unused operations.
 *
 * Therefore it is highly recommended to use the babel or swc plugin for production.
 * Learn more about it here: https://the-guild.dev/graphql/codegen/plugins/presets/preset-client#reducing-bundle-size
 */
type Documents = {
    "\n  query Home {\n    guides {\n      slug\n      title\n      region\n      difficulty\n      lengthKm\n    }\n    popularGuides(limit: 6) {\n      slug\n      title\n      region\n    }\n    regions\n    tours(limit: 5) {\n      id\n      title\n      distanceM\n    }\n  }\n": typeof types.HomeDocument,
    "\n  query ProfilTurer {\n    tours {\n      id\n      title\n      user {\n        id\n      }\n    }\n  }\n": typeof types.ProfilTurerDocument,
    "\n  query Tur($id: ID!) {\n    tour(id: $id) {\n      id\n      title\n      distanceM\n      notes\n      logs {\n        recordedAt\n        elevationM\n        heartRate\n      }\n    }\n  }\n": typeof types.TurDocument,
    "\n  query Turer {\n    tours {\n      id\n      title\n      distanceM\n      startedAt\n      user {\n        displayName\n      }\n      guide {\n        title\n        slug\n      }\n      photos {\n        id\n      }\n    }\n  }\n": typeof types.TurerDocument,
};
const documents: Documents = {
    "\n  query Home {\n    guides {\n      slug\n      title\n      region\n      difficulty\n      lengthKm\n    }\n    popularGuides(limit: 6) {\n      slug\n      title\n      region\n    }\n    regions\n    tours(limit: 5) {\n      id\n      title\n      distanceM\n    }\n  }\n": types.HomeDocument,
    "\n  query ProfilTurer {\n    tours {\n      id\n      title\n      user {\n        id\n      }\n    }\n  }\n": types.ProfilTurerDocument,
    "\n  query Tur($id: ID!) {\n    tour(id: $id) {\n      id\n      title\n      distanceM\n      notes\n      logs {\n        recordedAt\n        elevationM\n        heartRate\n      }\n    }\n  }\n": types.TurDocument,
    "\n  query Turer {\n    tours {\n      id\n      title\n      distanceM\n      startedAt\n      user {\n        displayName\n      }\n      guide {\n        title\n        slug\n      }\n      photos {\n        id\n      }\n    }\n  }\n": types.TurerDocument,
};

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 *
 *
 * @example
 * ```ts
 * const query = graphql(`query GetUser($id: ID!) { user(id: $id) { name } }`);
 * ```
 *
 * The query argument is unknown!
 * Please regenerate the types.
 */
export function graphql(source: string): unknown;

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query Home {\n    guides {\n      slug\n      title\n      region\n      difficulty\n      lengthKm\n    }\n    popularGuides(limit: 6) {\n      slug\n      title\n      region\n    }\n    regions\n    tours(limit: 5) {\n      id\n      title\n      distanceM\n    }\n  }\n"): (typeof documents)["\n  query Home {\n    guides {\n      slug\n      title\n      region\n      difficulty\n      lengthKm\n    }\n    popularGuides(limit: 6) {\n      slug\n      title\n      region\n    }\n    regions\n    tours(limit: 5) {\n      id\n      title\n      distanceM\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query ProfilTurer {\n    tours {\n      id\n      title\n      user {\n        id\n      }\n    }\n  }\n"): (typeof documents)["\n  query ProfilTurer {\n    tours {\n      id\n      title\n      user {\n        id\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query Tur($id: ID!) {\n    tour(id: $id) {\n      id\n      title\n      distanceM\n      notes\n      logs {\n        recordedAt\n        elevationM\n        heartRate\n      }\n    }\n  }\n"): (typeof documents)["\n  query Tur($id: ID!) {\n    tour(id: $id) {\n      id\n      title\n      distanceM\n      notes\n      logs {\n        recordedAt\n        elevationM\n        heartRate\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query Turer {\n    tours {\n      id\n      title\n      distanceM\n      startedAt\n      user {\n        displayName\n      }\n      guide {\n        title\n        slug\n      }\n      photos {\n        id\n      }\n    }\n  }\n"): (typeof documents)["\n  query Turer {\n    tours {\n      id\n      title\n      distanceM\n      startedAt\n      user {\n        displayName\n      }\n      guide {\n        title\n        slug\n      }\n      photos {\n        id\n      }\n    }\n  }\n"];

export function graphql(source: string) {
  return (documents as any)[source] ?? {};
}

export type DocumentType<TDocumentNode extends DocumentNode<any, any>> = TDocumentNode extends DocumentNode<  infer TType,  any>  ? TType  : never;