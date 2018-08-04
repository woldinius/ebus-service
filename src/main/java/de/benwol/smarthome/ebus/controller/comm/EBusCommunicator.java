package de.benwol.smarthome.ebus.controller.comm;

import java.io.IOException;
import java.io.OutputStream;
import java.net.Socket;

import de.benwol.smarthome.ebus.model.EBusTelegramm;
import lombok.ToString;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@ToString
public class EBusCommunicator {
    private Socket ebusSocket;

    public EBusCommunicator(Socket ebusSocket) {
        this.ebusSocket = ebusSocket;
    }

    public boolean writeTelegramm(EBusTelegramm ebusTelegramm) {
        try (OutputStream out = ebusSocket.getOutputStream()) {
            out.write(ebusTelegramm.byteArray());
            out.flush();
            return true;
        } catch (Exception e) {
            log.error("Excewption during write Message to Socket {}", e.getLocalizedMessage());
            log.debug("Full Stacktrace", e);
            return false;
        }
    }

    public boolean closeCommunication() {
        try {
            ebusSocket.close();
            return true;
        } catch (IOException e) {
            log.error("Excewption during close eBus communication", e.getLocalizedMessage());
            log.debug("Full Stacktrace", e);
            return false;
        }
    }

}