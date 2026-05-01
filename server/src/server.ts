import { env } from './config/env';
import { createApp } from './app';

const app = createApp();

app.listen(Number(env.PORT), () => {
  console.log(`Server running on port ${env.PORT}`);
});
