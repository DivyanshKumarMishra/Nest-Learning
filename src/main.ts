import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { ApiInterceptor } from './common/interceptors/api.interceptor';
import { HttpExceptionFilter } from './common/exception-filters/http.exception';
import { AllExceptionsFilter } from './common/exception-filters/all-exceptions.filter';
import appConfig from './config/app.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // GLOBAL PIPE WIRING
  // useGlobalPipes registers the pipe for every route in the app.
  // It only activates on routes that have a @Body(), @Param(), or @Query() —
  // GET routes with no body are unaffected.
  //
  // Alternative: @UsePipes(new ValidationPipe()) on a specific controller method
  // — use this only when one route needs different validation rules than the rest.
  //
  // VALIDATION PIPE OPTIONS:
  //   whitelist: true
  //     Strips any field from the body that isn't declared in the DTO (silently).
  //     e.g. { name, email, password, role: "admin" } → role is dropped before controller runs.
  //
  //   forbidNonWhitelisted: true
  //     Upgrades whitelist behavior from "strip silently" to "throw 400".
  //     Requires whitelist: true to work — it changes what happens when a non-whitelisted
  //     field is found, not whether to look for them.
  //     e.g. { name, email, password, role: "admin" } → 400 "property role should not exist"
  //
  //   transform: true
  //     Converts the plain JSON body into an actual instance of your DTO class.
  //     Without this, @Body() is a plain JS object — class-validator decorators
  //     can't inspect it. Also enables auto-coercion of @Param() strings to
  //     typed values (e.g. "123" → number if DTO declares id: number).
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalInterceptors(new ApiInterceptor());

  // Filter order doesn't affect resolution — Nest picks the most specific
  // filter by exception class hierarchy. AllExceptionsFilter (@Catch())
  // matches everything; HttpExceptionFilter (@Catch(HttpException)) is more
  // specific and wins for HttpException-derived errors. Listing the catch-all
  // first is convention.
  app.useGlobalFilters(new AllExceptionsFilter(), new HttpExceptionFilter());

  // TYPED CONFIG ACCESS via registerAs + ConfigType (outside DI — i.e. in main.ts)
  // Inside a service you'd inject the config via the constructor:
  //   @Inject(appConfig.KEY) private readonly cfg: ConfigType<typeof appConfig>
  // But main.ts isn't a class, so we pull the same object from the app's DI
  // container manually via app.get(appConfig.KEY). The ConfigType<...> cast
  // gives us full autocompletion (cfg.port, cfg.nodeEnv) — no string keys,
  // no <number> assertions, no parseInt.
  const cfg = app.get<ConfigType<typeof appConfig>>(appConfig.KEY);
  await app.listen(cfg.port);
}
bootstrap();
