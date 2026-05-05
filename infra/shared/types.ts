// Transport-agnostic request/response types so the handler can be unit-tested
// without mocking Lambda Function URL events.

export type HandlerRequest = {
  method: string;
  path: string;          // e.g. "/jhammant/factcheck.md"
  search: string;        // e.g. "?task=add-tests"
  headers: Record<string, string | undefined>;
  ip?: string;
};

export type HandlerResponse = {
  status: number;
  headers: Record<string, string>;
  body: string;
};
