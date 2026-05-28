import { defineMiddleware } from "astro:middleware";
import { createClient } from "@supabase/supabase-js";

const PUBLIC_PATHS = ["/", "/auth/callback"];

export const onRequest = defineMiddleware(async (context, next) => {
	const { pathname } = context.url;

	if (PUBLIC_PATHS.includes(pathname)) {
		return next();
	}

	const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
	const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

	if (!supabaseUrl || !supabaseAnonKey) {
		return next();
	}

	const supabase = createClient(supabaseUrl, supabaseAnonKey);

	const accessToken = context.cookies.get("sb-access-token")?.value;
	const refreshToken = context.cookies.get("sb-refresh-token")?.value;

	if (!accessToken || !refreshToken) {
		return context.redirect("/");
	}

	const { data, error } = await supabase.auth.setSession({
		access_token: accessToken,
		refresh_token: refreshToken,
	});

	if (error || !data.session) {
		return context.redirect("/");
	}

	context.locals.user = data.session.user;
	context.locals.session = data.session;

	return next();
});
