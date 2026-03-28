import jwt from "jsonwebtoken";

const parseCookieToken = (cookieHeader) => {
  if (!cookieHeader || typeof cookieHeader !== "string") return "";
  const pairs = cookieHeader.split(";").map((part) => part.trim());
  const tokenPair = pairs.find((part) => part.startsWith("token="));
  if (!tokenPair) return "";
  return decodeURIComponent(tokenPair.slice(6));
};

export const signToken = (user, secret) =>
  jwt.sign(
    { id: String(user._id), username: user.username, email: user.email },
    secret,
    { expiresIn: "7d" }
  );

export const authHttp = (secret) => (req, res, next) => {
  const bearer = req.headers.authorization?.startsWith("Bearer ")
    ? req.headers.authorization.slice(7)
    : null;
  const token = bearer || req.cookies?.token;

  if (!token) return res.status(401).json({ message: "Unauthorized" });

  try {
    req.user = jwt.verify(token, secret);
    next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
};

export const authSocket = (secret) => (socket, next) => {
  const tokenFromAuth = socket.handshake.auth?.token;
  const tokenFromCookie = parseCookieToken(socket.handshake.headers?.cookie);
  const token = tokenFromAuth || tokenFromCookie;
  if (!token) return next(new Error("Unauthorized"));

  try {
    socket.user = jwt.verify(token, secret);
    return next();
  } catch {
    return next(new Error("Invalid token"));
  }
};
