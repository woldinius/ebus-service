package de.benwol.smarthome.ebus.wolf.controller;

import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestMapping;

@RestController()
@RequestMapping("/wolf/cwl")
public class ISM8Controller {

    @RequestMapping("/")
    public String index() {
        return "I'm alive and can controll Wolf Things";
    }

}
