export const getErrorMessage = (err) => {
  if (err.response?.data?.error?.message) return err.response.data.error.message;
  if (typeof err.response?.data?.error === 'string') return err.response.data.error;
  return err.message || 'An unexpected error occurred';
};
