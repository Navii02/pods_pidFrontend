import axios from "axios";

export const commonApi = async (httpRequest, url, reqBody, reqHeader = {}, params) => {
  const { onUploadProgress, ...headers } = reqHeader;

  const reqConfig = {
    method: httpRequest,
    url,
    data: reqBody,
    headers: headers || { "Content-Type": "application/json" },
    params: params,
  };

  if (onUploadProgress) {
    reqConfig.onUploadProgress = onUploadProgress;
  }

  // Apply responseType if provided
  if (headers.responseType) {
    reqConfig.responseType = headers.responseType;
    delete headers.responseType;
  }

  try {
    const result = await axios(reqConfig);
    return reqConfig.responseType === 'blob' ? result.data : result;
  } catch (err) {
    console.error('commonApi error:', {
      url,
      status: err.response?.status,
      message: err.message,
      data: err.response?.data,
    });
    throw err;
  }
};
