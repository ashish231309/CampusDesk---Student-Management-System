/**
 * Uniform success envelope so the frontend only ever parses one response shape.
 * { success: true, data, meta? }
 */
export const sendSuccess = (res, data = null, { statusCode = 200, meta } = {}) => {
  const body = { success: true, data };
  if (meta) body.meta = meta;
  return res.status(statusCode).json(body);
};

export const sendCreated = (res, data, meta) => sendSuccess(res, data, { statusCode: 201, meta });

export const sendNoContent = (res) => res.status(204).send();
