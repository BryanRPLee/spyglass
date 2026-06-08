import { verifyToken } from "@clerk/backend";

export async function verifyClerkToken(token: string): Promise<string> {
    const payload = await verifyToken(token, {
        secretKey: process.env.CLERK_SECRET_KEY!
    })
    return payload.sub
}