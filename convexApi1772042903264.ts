import { type FunctionReference, anyApi } from "convex/server";
import { type GenericId as Id } from "convex/values";

export const api: PublicApiType = anyApi as unknown as PublicApiType;
export const internal: InternalApiType = anyApi as unknown as InternalApiType;

export type PublicApiType = {
  auth: {
    isAuthenticated: FunctionReference<
      "query",
      "public",
      Record<string, never>,
      any
    >;
    signIn: FunctionReference<
      "action",
      "public",
      {
        calledBy?: string;
        params?: any;
        provider?: string;
        refreshToken?: string;
        verifier?: string;
      },
      any
    >;
    signOut: FunctionReference<"action", "public", Record<string, never>, any>;
  };
  models: {
    list: FunctionReference<
      "query",
      "public",
      Record<string, never>,
      Array<{
        _creationTime: number;
        _id: Id<"models">;
        key: string;
        name: string;
        url: string;
      }>
    >;
    getById: FunctionReference<
      "query",
      "public",
      { id: Id<"models"> },
      {
        _creationTime: number;
        _id: Id<"models">;
        key: string;
        name: string;
        url: string;
      } | null
    >;
    getByName: FunctionReference<
      "query",
      "public",
      { name: string },
      {
        _creationTime: number;
        _id: Id<"models">;
        key: string;
        name: string;
        url: string;
      } | null
    >;
    create: FunctionReference<
      "mutation",
      "public",
      { key: string; name: string; url: string },
      Id<"models">
    >;
    update: FunctionReference<
      "mutation",
      "public",
      { id: Id<"models">; key?: string; name?: string; url?: string },
      null
    >;
    remove: FunctionReference<"mutation", "public", { id: Id<"models"> }, null>;
  };
  methods: {
    list: FunctionReference<
      "query",
      "public",
      Record<string, never>,
      Array<{
        _creationTime: number;
        _id: Id<"methods">;
        inputs: Array<string>;
        modelId: Id<"models">;
        name: string;
        outputFormat: string;
        prompt: string;
        settings?: any;
        variables: Array<
          | { name: string; type: "literal"; value: any }
          | {
              headers: Record<string, string>;
              method:
                | "GET"
                | "get"
                | "POST"
                | "post"
                | "PUT"
                | "put"
                | "DELETE"
                | "delete"
                | "PATCH"
                | "patch"
                | "OPTIONS"
                | "options";
              name: string;
              payload: any;
              type: "function";
              url: string;
            }
        >;
      }>
    >;
    getById: FunctionReference<
      "query",
      "public",
      { id: Id<"methods"> },
      {
        _creationTime: number;
        _id: Id<"methods">;
        inputs: Array<string>;
        modelId: Id<"models">;
        name: string;
        outputFormat: string;
        prompt: string;
        settings?: any;
        variables: Array<
          | { name: string; type: "literal"; value: any }
          | {
              headers: Record<string, string>;
              method:
                | "GET"
                | "get"
                | "POST"
                | "post"
                | "PUT"
                | "put"
                | "DELETE"
                | "delete"
                | "PATCH"
                | "patch"
                | "OPTIONS"
                | "options";
              name: string;
              payload: any;
              type: "function";
              url: string;
            }
        >;
      } | null
    >;
    getByName: FunctionReference<
      "query",
      "public",
      { name: string },
      {
        _creationTime: number;
        _id: Id<"methods">;
        inputs: Array<string>;
        modelId: Id<"models">;
        name: string;
        outputFormat: string;
        prompt: string;
        settings?: any;
        variables: Array<
          | { name: string; type: "literal"; value: any }
          | {
              headers: Record<string, string>;
              method:
                | "GET"
                | "get"
                | "POST"
                | "post"
                | "PUT"
                | "put"
                | "DELETE"
                | "delete"
                | "PATCH"
                | "patch"
                | "OPTIONS"
                | "options";
              name: string;
              payload: any;
              type: "function";
              url: string;
            }
        >;
      } | null
    >;
    create: FunctionReference<
      "mutation",
      "public",
      {
        inputs: Array<string>;
        modelId: Id<"models">;
        name: string;
        outputFormat: string;
        prompt: string;
        settings?: any;
        variables: Array<
          | { name: string; type: "literal"; value: any }
          | {
              headers: Record<string, string>;
              method:
                | "GET"
                | "get"
                | "POST"
                | "post"
                | "PUT"
                | "put"
                | "DELETE"
                | "delete"
                | "PATCH"
                | "patch"
                | "OPTIONS"
                | "options";
              name: string;
              payload: any;
              type: "function";
              url: string;
            }
        >;
      },
      Id<"methods">
    >;
    update: FunctionReference<
      "mutation",
      "public",
      {
        id: Id<"methods">;
        inputs?: Array<string>;
        modelId?: Id<"models">;
        name?: string;
        outputFormat?: string;
        prompt?: string;
        settings?: any;
        variables?: Array<
          | { name: string; type: "literal"; value: any }
          | {
              headers: Record<string, string>;
              method:
                | "GET"
                | "get"
                | "POST"
                | "post"
                | "PUT"
                | "put"
                | "DELETE"
                | "delete"
                | "PATCH"
                | "patch"
                | "OPTIONS"
                | "options";
              name: string;
              payload: any;
              type: "function";
              url: string;
            }
        >;
      },
      null
    >;
    remove: FunctionReference<
      "mutation",
      "public",
      { id: Id<"methods"> },
      null
    >;
    runMethod: FunctionReference<
      "action",
      "public",
      { inputData: any; methodName: string },
      {
        methodName: string;
        model: { name: string; url: string };
        output: any;
        prompt: string;
        resolvedVariables: Record<string, any>;
      }
    >;
  };
};
export type InternalApiType = {};
