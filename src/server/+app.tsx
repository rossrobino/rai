import { App } from "ovr";
import * as routes from "@/server/routes";

const app = new App();

app.use(routes);

export default app;
