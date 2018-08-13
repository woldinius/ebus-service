package de.benwol.smarthome.ebus.controller;

import de.benwol.smarthome.ebus.controller.comm.EBusCommunicator;
import de.benwol.smarthome.ebus.model.EBusTelegramm;
import lombok.extern.slf4j.Slf4j;

@Slf4j
public class EbusController  {

    private EBusCommunicator eBusSender;

    public EbusController(EBusCommunicator eBusSender) {
        this.eBusSender = eBusSender;
    }

    public boolean sendMessage(EBusTelegramm ebusTelegramm) {
        log.debug("send an telegramm {} to {}", ebusTelegramm.toString(), eBusSender.toString());
        return eBusSender.sendTelegramm(ebusTelegramm);
    }

    public void recieved(EBusTelegramm busTelegramm) {
        // TODO logs
        System.out.println("recived: " + busTelegramm.toString());
    }

}