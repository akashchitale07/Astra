import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const SECRET_KEY = process.env.JWT_SECRET_KEY || "change_me";
const ALGORITHM = process.env.JWT_ALGORITHM || "HS256";
const EXPIRE_MINUTES = parseInt(process.env.ACCESS_TOKEN_EXPIRE_MINUTES || "1440", 10);

export function hashPassword(password: string): string {
  const salt = bcrypt.genSaltSync(10);
  return bcrypt.hashSync(password, salt);
}

export function verifyPassword(password: string, hashed: string): boolean {
  return bcrypt.compareSync(password, hashed);
}

export interface TokenPayload {
  sub: string; // user id
  email: string;
}

export function createAccessToken(userId: string, email: string): string {
  const payload: TokenPayload = { sub: userId, email };
  return jwt.sign(payload, SECRET_KEY, {
    algorithm: ALGORITHM as jwt.Algorithm,
    expiresIn: `${EXPIRE_MINUTES}m`,
  });
}

export function verifyAccessToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, SECRET_KEY, {
      algorithms: [ALGORITHM as jwt.Algorithm],
    }) as TokenPayload;
  } catch (error) {
    return null;
  }
}
