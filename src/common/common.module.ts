import { Module, Global } from '@nestjs/common';
import { UrlNormalizerService } from './services/url-normalizer.service';
import { AppConfigModule } from '../config/config.module';

@Global()
@Module({
    imports: [AppConfigModule],
    providers: [UrlNormalizerService],
    exports: [UrlNormalizerService],
})
export class CommonModule { }
