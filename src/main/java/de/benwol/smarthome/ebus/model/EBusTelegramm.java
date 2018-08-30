package de.benwol.smarthome.ebus.model;

import com.fasterxml.jackson.core.util.ByteArrayBuilder;

import lombok.Cleanup;

public class EBusTelegramm implements EBusUsable {

    private EBusHeader eBusHeader;

    public EBusTelegramm() {

    }

    public byte[] byteArray() {
        @Cleanup ByteArrayBuilder builder = new ByteArrayBuilder();
        builder.write(eBusHeader.byteArray());
        
        return builder.toByteArray();
    }

}