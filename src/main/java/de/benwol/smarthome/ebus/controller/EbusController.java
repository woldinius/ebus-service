package de.benwol.smarthome.ebus.controller;

import java.net.Socket;
import de.benwol.smarthome.ebus.model.EBusTelegramm;;

public class EbusController {

    private Socket ebusMasterSocket;

    public EbusController(Socket ebusMasterSocket) {
        this.ebusMasterSocket = ebusMasterSocket;
    }

    public boolean sendMessage(EbusTelegramm EbusTelegramm) {
        ebusMasterSocket.getOutputStream().write(EbusTelegramm);
    }

}