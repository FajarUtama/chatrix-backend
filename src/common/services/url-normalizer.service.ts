import { Injectable } from '@nestjs/common';
import { ConfigService } from '../../config/config.service';

@Injectable()
export class UrlNormalizerService {
    constructor(private configService: ConfigService) { }

    /**
     * Normalize MinIO URLs to use public endpoint
     * Replaces internal hostnames with public IP/domain
     */
    normalizeUrl(url: string | undefined | null): string {
        if (!url) return '';

        const config = this.configService.minioConfig;

        // If CDN URL is configured, replace MinIO URLs with CDN
        if (config.cdnUrl) {
            // Replace any MinIO URL pattern with CDN URL
            return url.replace(
                /https?:\/\/[^\/]+\/([^\/]+)\/(.*)/,
                `${config.cdnUrl}/$1/$2`
            );
        }

        // Use publicEndpoint if configured, otherwise use endPoint
        const publicEndpoint = config.publicEndpoint || config.endPoint;
        const protocol = config.useSSL ? 'https' : 'http';
        const port = config.port ? `:${config.port}` : '';
        const publicUrl = `${protocol}://${publicEndpoint}${port}`;

        // Replace internal MinIO hostname patterns with public URL
        const patterns = [
            /http:\/\/minio:9000/g,
            /https:\/\/minio:9000/g,
            /http:\/\/localhost:9000/g,
            /https:\/\/localhost:9000/g,
        ];

        let normalizedUrl = url;
        for (const pattern of patterns) {
            normalizedUrl = normalizedUrl.replace(pattern, publicUrl);
        }

        return normalizedUrl;
    }

    /**
     * Normalize multiple URLs
     */
    normalizeUrls(urls: (string | undefined | null)[]): string[] {
        return urls.map(url => this.normalizeUrl(url));
    }
}
