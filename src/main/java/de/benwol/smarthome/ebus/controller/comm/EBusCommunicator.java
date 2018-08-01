package de.benwol.smarthome.ebus.controller.comm;

import java.io.OutputStream;
import java.net.Socket;

import de.benwol.smarthome.ebus.model.EBusTelegramm;

public class EBusCommunicator {
    private Socket ebusSocket;

    public EBusCommunicator(Socket ebusSocket) {
        this.ebusSocket = ebusSocket;
    }

    public boolean writeTelegramm(EBusTelegramm ebusTelegramm) {
        try (OutputStream out = ebusSocket.getOutputStream()) {
            out.write(ebusTelegramm.toByteArray());
            out.flush();
            out.close();
            return true;
        } catch (Exception e) {
            e.printStackTrace();
        } 
        return false;
    }
}