import {Controller} from "@tsed/di";
import {Get, Returns, Status} from "@tsed/schema";

@Controller("/health")
export class HealthController {
  @Get("/live")
  @Status(200)
  @Returns(200, Object)
  live() {
    return {
      status: "ok"
    };
  }
}
