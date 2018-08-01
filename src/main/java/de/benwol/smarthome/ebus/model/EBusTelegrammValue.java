package de.benwol.smarthome.ebus.model;

import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode
public class EBusTelegrammValue {

    public static EBusTelegrammValue of(int index, byte... value) {
        return new EBusTelegrammValue(value, index, value.length);
    }

    private byte[] value;
    private int index;
    private int length;

    public EBusTelegrammValue(byte[] value, int index, int length) {
        assert (value.length <= length);
        assert (index > 0);
        setValue(value);
        setIndex(index);
        setLength(length);
    }
}