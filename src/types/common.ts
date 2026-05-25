type SuccessResponse = {
  ok: boolean;
  data: unknown;
};

type ErrorResponse = {
  ok: boolean;
  error: string;
};

type ApiResponse = SuccessResponse | ErrorResponse;
export default ApiResponse;
