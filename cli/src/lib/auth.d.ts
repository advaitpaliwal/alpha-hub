export declare function getAccessToken(): string | null;
export declare function getUserId(): string | null;
export declare function getUserName(): string | null;
export declare function getUserEmail(): string | null;
export declare function hasSavedAuth(): boolean;
export declare function refreshAccessToken(): Promise<string | null>;
export declare function login(options?: {
	headless?: boolean;
}): Promise<{
	tokens: unknown;
	userInfo: unknown;
}>;
export declare function getValidToken(): Promise<string | null>;
export declare function getLoginState(): Promise<"missing" | "valid" | "expired" | "invalid">;
export declare function isLoggedIn(): boolean;
export declare function logout(): void;
