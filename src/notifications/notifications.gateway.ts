import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { JwtService } from "@nestjs/jwt";
import { Logger } from "@nestjs/common";

@WebSocketGateway({
  cors: {
    origin: "*",
  },
})
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationsGateway.name);

  constructor(private readonly jwtService: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth.token ||
        client.handshake.headers["authorization"]?.replace("Bearer ", "");
      if (!token) {
        throw new Error("No token provided");
      }

      const payload = this.jwtService.verify(token);
      const campId = payload.campId;

      const room = `camp_${campId}`;
      client.join(room);
      this.logger.log(`Client ${client.id} joined room ${room}`);
    } catch (error) {
      this.logger.error(
        `Client ${client.id} disconnected due to invalid token: ${error.message}`,
      );
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client ${client.id} disconnected`);
  }

  emitTransferRequest(campId: number, requestData: any) {
    this.server.to(`camp_${campId}`).emit("transfer.requested", requestData);
  }
}
