export async function handler(event) {
    const code = event.queryStringParameters.code;

    if (!code) {
        return {
            statusCode: 400,
            body: "Missing code"
        };
    }

    const response = await fetch("https://www.strava.com/api/v3/oauth/token", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            client_id: process.env.STRAVA_CLIENT_ID,
            client_secret: process.env.STRAVA_CLIENT_SECRET,
            code,
            grant_type: "authorization_code"
        })
    });

    const data = await response.json();

    if (!data.access_token) {
        return {
            statusCode: 500,
            body: JSON.stringify(data)
        };
    }

    return {
        statusCode: 302,
        headers: {
            Location:
                "https://jonaswoetmann.github.io/Sports-app/" +
                `#access_token=${data.access_token}`
        }
    };
}