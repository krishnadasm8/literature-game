import jwt, { type JwtPayload, type Secret, type SignOptions } from "jsonwebtoken";

type TokenPayload = JwtPayload & {
  sub?: string;
  userId?: string;
};

const getSecret = (key: "JWT_SECRET" | "JWT_REFRESH_SECRET"): Secret => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`${key} is not configured`);
  }
  return value;
};

const signToken = (
  payload: TokenPayload,
  secret: Secret,
  expiresIn: SignOptions["expiresIn"],
): string => {
  return jwt.sign(payload, secret, { expiresIn });
};

export const signAccessToken = (userId: string): string => {
  return signToken({ sub: userId }, getSecret("JWT_SECRET"), "15m");
};

export const signRefreshToken = (userId: string): string => {
  return signToken({ sub: userId }, getSecret("JWT_REFRESH_SECRET"), "30d");
};

export const verifyToken = (token: string, secret: Secret = getSecret("JWT_SECRET")): TokenPayload => {
  const decoded = jwt.verify(token, secret);
  if (typeof decoded === "string") {
    throw new Error("Invalid token payload");
  }
  const userId = decoded.userId ?? decoded.sub;
  if (!userId) {
    throw new Error("Invalid token payload");
  }
  return {
    ...decoded,
    userId,
    sub: decoded.sub ?? userId,
  } as TokenPayload;
};
