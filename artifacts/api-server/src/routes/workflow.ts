import { Router, type IRouter } from "express";
import approvalsRouter from "./approvals";
import ordersRouter from "./orders";
import ticketsRouter from "./tickets";

const router: IRouter = Router();

router.use(approvalsRouter);
router.use(ticketsRouter);
router.use(ordersRouter);

export default router;
