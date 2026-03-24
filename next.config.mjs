/** @type {import('next').NextConfig} */
const nextConfig = {
    // Add rewrites for development proxying to Go backend
    async rewrites() {
        return [
            {
                source: "/rpc/:path*",
                destination: "http://localhost:8080/rpc/:path*",
            },
        ];
    },
    images: {
        remotePatterns: [
            {
                protocol: 'http',
                hostname: 'localhost',
            },
        ],
    },
}

export default nextConfig
