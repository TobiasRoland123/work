// For providers endpoint, use the handler directly
export const GET = async (req: Request) => {
  const url = new URL(req.url);
  const response = await fetch(`${url.origin}/api/auth/providers`);
  return response;
};
